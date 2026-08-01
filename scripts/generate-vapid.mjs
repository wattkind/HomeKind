#!/usr/bin/env node
// Generates a VAPID key pair for Web Push and prints env lines ready to paste
// into .env. Run with: node scripts/generate-vapid.mjs
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
