import Capacitor
import Foundation
import zlib

/// Builds a backup zip from files on disk, streaming each one, so the web view never
/// holds the attachments or the archive. Called by `src/platform/backupZip.ts`.
///
/// Entries are stored (method 0, no compression): photos and PDFs do not compress,
/// and the archive layout is the one `src/data/backup.ts` has always produced, so
/// backups made by either path restore the same way.
@objc(BackupZipPlugin)
public class BackupZipPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BackupZipPlugin"
    public let jsName = "BackupZip"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "create", returnType: CAPPluginReturnPromise)
    ]

    @objc func create(_ call: CAPPluginCall) {
        guard let output = call.getString("output"),
              let outputURL = URL(string: output), outputURL.isFileURL else {
            call.reject("output must be a file URL")
            return
        }
        guard let manifest = call.getString("manifest") else {
            call.reject("manifest is required")
            return
        }
        guard let rawFiles = call.getArray("files", JSObject.self) else {
            call.reject("files is required")
            return
        }
        var files: [(entry: String, url: URL)] = []
        for raw in rawFiles {
            guard let entry = raw["entry"] as? String, let uri = raw["uri"] as? String,
                  let url = URL(string: uri), url.isFileURL else {
                call.reject("each file needs an entry name and a file URL")
                return
            }
            files.append((entry, url))
        }

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let skipped = try StoredZipWriter.write(to: outputURL, manifest: manifest, files: files)
                call.resolve(["skipped": skipped])
            } catch {
                try? FileManager.default.removeItem(at: outputURL)
                call.reject("The backup could not be written. \(error.localizedDescription)")
            }
        }
    }
}

enum StoredZipError: LocalizedError {
    case tooLarge
    case cannotCreate(String)
    case fileChanged(String)

    var errorDescription: String? {
        switch self {
        case .tooLarge: return "The backup would be larger than 4 GB, which a zip file cannot hold."
        case .cannotCreate(let path): return "Could not create \(path)."
        case .fileChanged(let name): return "\(name) changed while it was being copied."
        }
    }
}

/// A minimal store-only zip writer: local headers, central directory, end record.
/// No zip64, so the archive and each file must stay under 4 GB.
enum StoredZipWriter {
    private static let copyChunk = 1024 * 1024
    private static let utf8Names: UInt16 = 0x0800
    private static let version: UInt16 = 20

    /// Returns the entry names that were skipped because their file could not be read.
    static func write(to output: URL, manifest: String, files: [(entry: String, url: URL)]) throws -> [String] {
        let fm = FileManager.default
        try? fm.removeItem(at: output)
        guard fm.createFile(atPath: output.path, contents: nil) else {
            throw StoredZipError.cannotCreate(output.lastPathComponent)
        }
        let out = try FileHandle(forWritingTo: output)
        defer { try? out.close() }

        let (dosTime, dosDate) = dosDateTime(Date())
        var central = Data()
        var offset: UInt64 = 0
        var count = 0
        var skipped: [String] = []

        func add(name: String, size: UInt64, crc: UInt32, body: () throws -> Void) throws {
            guard size < 0xFFFF_FFFF, offset < 0xFFFF_FFFF else { throw StoredZipError.tooLarge }
            let nameBytes = Array(name.utf8)

            var local = Data()
            local.appendLE(UInt32(0x0403_4B50))
            local.appendLE(version)
            local.appendLE(utf8Names)
            local.appendLE(UInt16(0)) // stored
            local.appendLE(dosTime)
            local.appendLE(dosDate)
            local.appendLE(crc)
            local.appendLE(UInt32(size))
            local.appendLE(UInt32(size))
            local.appendLE(UInt16(nameBytes.count))
            local.appendLE(UInt16(0))
            local.append(contentsOf: nameBytes)
            try out.write(contentsOf: local)
            try body()

            central.appendLE(UInt32(0x0201_4B50))
            central.appendLE(version)
            central.appendLE(version)
            central.appendLE(utf8Names)
            central.appendLE(UInt16(0))
            central.appendLE(dosTime)
            central.appendLE(dosDate)
            central.appendLE(crc)
            central.appendLE(UInt32(size))
            central.appendLE(UInt32(size))
            central.appendLE(UInt16(nameBytes.count))
            central.appendLE(UInt16(0)) // extra
            central.appendLE(UInt16(0)) // comment
            central.appendLE(UInt16(0)) // disk
            central.appendLE(UInt16(0)) // internal attributes
            central.appendLE(UInt32(0)) // external attributes
            central.appendLE(UInt32(offset))
            central.append(contentsOf: nameBytes)

            offset += UInt64(local.count) + size
            count += 1
        }

        let manifestData = Data(manifest.utf8)
        try add(name: "data.json", size: UInt64(manifestData.count), crc: crc32(of: manifestData)) {
            try out.write(contentsOf: manifestData)
        }

        for file in files {
            // One pass for the checksum, one to copy. Attachments never change during an
            // export, and a mismatch is reported rather than written as a corrupt entry.
            guard let checked = try? sizeAndCrc(of: file.url) else {
                skipped.append(file.entry)
                continue
            }
            try add(name: file.entry, size: checked.size, crc: checked.crc) {
                let copied = try copy(file.url, to: out)
                if copied != checked.size { throw StoredZipError.fileChanged(file.entry) }
            }
        }

        guard central.count < 0xFFFF_FFFF, offset < 0xFFFF_FFFF, count < 0xFFFF else {
            throw StoredZipError.tooLarge
        }
        var end = Data()
        end.appendLE(UInt32(0x0605_4B50))
        end.appendLE(UInt16(0))
        end.appendLE(UInt16(0))
        end.appendLE(UInt16(count))
        end.appendLE(UInt16(count))
        end.appendLE(UInt32(central.count))
        end.appendLE(UInt32(offset))
        end.appendLE(UInt16(0))
        try out.write(contentsOf: central)
        try out.write(contentsOf: end)
        return skipped
    }

    private static func sizeAndCrc(of url: URL) throws -> (size: UInt64, crc: UInt32) {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        var size: UInt64 = 0
        var crc: uLong = 0
        while let chunk = try handle.read(upToCount: copyChunk), !chunk.isEmpty {
            size += UInt64(chunk.count)
            crc = update(crc, with: chunk)
        }
        return (size, UInt32(crc))
    }

    private static func copy(_ url: URL, to out: FileHandle) throws -> UInt64 {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        var copied: UInt64 = 0
        while let chunk = try handle.read(upToCount: copyChunk), !chunk.isEmpty {
            try out.write(contentsOf: chunk)
            copied += UInt64(chunk.count)
        }
        return copied
    }

    private static func crc32(of data: Data) -> UInt32 {
        UInt32(update(0, with: data))
    }

    private static func update(_ crc: uLong, with data: Data) -> uLong {
        guard !data.isEmpty else { return crc }
        return data.withUnsafeBytes { buffer -> uLong in
            zlib.crc32(crc, buffer.bindMemory(to: Bytef.self).baseAddress, uInt(buffer.count))
        }
    }

    private static func dosDateTime(_ date: Date) -> (UInt16, UInt16) {
        let c = Calendar(identifier: .gregorian).dateComponents(in: .current, from: date)
        let year = max(1980, c.year ?? 1980)
        let time = UInt16(((c.hour ?? 0) << 11) | ((c.minute ?? 0) << 5) | ((c.second ?? 0) / 2))
        let day = UInt16(((year - 1980) << 9) | ((c.month ?? 1) << 5) | (c.day ?? 1))
        return (time, day)
    }
}

private extension Data {
    mutating func appendLE<T: FixedWidthInteger>(_ value: T) {
        var little = value.littleEndian
        Swift.withUnsafeBytes(of: &little) { append(contentsOf: $0) }
    }
}
