package ai.wattkind.homekind;

import android.net.Uri;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.CRC32;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Builds a backup zip from files on disk, streaming each one, so the web view never
 * holds the attachments or the archive. Called by {@code src/platform/backupZip.ts}.
 *
 * Entries are stored (no compression): photos and PDFs do not compress, and the
 * archive layout is the one {@code src/data/backup.ts} has always produced.
 */
@CapacitorPlugin(name = "BackupZip")
public class BackupZipPlugin extends Plugin {

    private static final int COPY_CHUNK = 1024 * 1024;

    private static final class Entry {
        final String name;
        final File file;

        Entry(String name, File file) {
            this.name = name;
            this.file = file;
        }
    }

    @PluginMethod
    public void create(PluginCall call) {
        String output = call.getString("output");
        String manifest = call.getString("manifest");
        JSArray rawFiles = call.getArray("files");
        if (output == null || manifest == null || rawFiles == null) {
            call.reject("output, manifest and files are required");
            return;
        }
        File outputFile = fileOf(output);
        if (outputFile == null) {
            call.reject("output must be a file URL");
            return;
        }
        List<Entry> files = new ArrayList<>();
        try {
            for (int i = 0; i < rawFiles.length(); i++) {
                JSONObject raw = rawFiles.getJSONObject(i);
                File file = fileOf(raw.getString("uri"));
                if (file == null) {
                    call.reject("each file needs an entry name and a file URL");
                    return;
                }
                files.add(new Entry(raw.getString("entry"), file));
            }
        } catch (JSONException e) {
            call.reject("each file needs an entry name and a file URL");
            return;
        }

        bridge.execute(() -> {
            try {
                List<String> skipped = write(outputFile, manifest, files);
                JSObject result = new JSObject();
                result.put("skipped", new JSArray(skipped));
                call.resolve(result);
            } catch (IOException e) {
                //noinspection ResultOfMethodCallIgnored
                outputFile.delete();
                call.reject("The backup could not be written. " + e.getMessage());
            }
        });
    }

    private static File fileOf(String uri) {
        Uri parsed = Uri.parse(uri);
        if (!"file".equals(parsed.getScheme()) || parsed.getPath() == null) return null;
        return new File(parsed.getPath());
    }

    /** Returns the entry names skipped because their file could not be read. */
    private static List<String> write(File output, String manifest, List<Entry> files) throws IOException {
        List<String> skipped = new ArrayList<>();
        //noinspection ResultOfMethodCallIgnored
        output.delete();
        try (ZipOutputStream zip = new ZipOutputStream(new BufferedOutputStream(new FileOutputStream(output)))) {
            byte[] manifestBytes = manifest.getBytes(StandardCharsets.UTF_8);
            CRC32 crc = new CRC32();
            crc.update(manifestBytes);
            zip.putNextEntry(stored("data.json", manifestBytes.length, crc.getValue()));
            zip.write(manifestBytes);
            zip.closeEntry();

            byte[] buffer = new byte[COPY_CHUNK];
            for (Entry entry : files) {
                // One pass for the checksum (a stored entry's header needs it up front),
                // one to copy. Attachments never change during an export.
                long size;
                long checksum;
                try (InputStream in = new FileInputStream(entry.file)) {
                    crc.reset();
                    size = 0;
                    int n;
                    while ((n = in.read(buffer)) > 0) {
                        crc.update(buffer, 0, n);
                        size += n;
                    }
                    checksum = crc.getValue();
                } catch (IOException e) {
                    skipped.add(entry.name);
                    continue;
                }
                zip.putNextEntry(stored(entry.name, size, checksum));
                try (InputStream in = new FileInputStream(entry.file)) {
                    int n;
                    while ((n = in.read(buffer)) > 0) zip.write(buffer, 0, n);
                }
                zip.closeEntry();
            }
        }
        return skipped;
    }

    private static ZipEntry stored(String name, long size, long crc) {
        ZipEntry entry = new ZipEntry(name);
        entry.setMethod(ZipEntry.STORED);
        entry.setSize(size);
        entry.setCompressedSize(size);
        entry.setCrc(crc);
        return entry;
    }
}
