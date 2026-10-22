# Security

HomeKind runs entirely on the phone. It has no server, no account and no
network calls of its own, so most classic app vulnerabilities do not apply.
The areas that do matter are the local database, the backup zip import and
export, attachment handling (photos and PDFs), and the build and signing
pipeline.

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Email **support@wattkind.ai** with "HomeKind security" in the subject. Include
the app version (Settings > About), the platform, and steps to reproduce. A
proof-of-concept backup zip or attachment is welcome if the issue involves
import or file handling.

You will get an acknowledgement within 5 business days. WattKind AI is a
small family business, so fixes ship as fast as the App Store and Google Play
review cycles allow. We will credit you in the release notes if you would like.

## Scope

In scope: this repository and the HomeKind apps on the App Store and Google
Play.

Out of scope: the wattkind.ai website, other WattKind AI products, and issues
that require a jailbroken or rooted device or physical access to an unlocked
phone.
