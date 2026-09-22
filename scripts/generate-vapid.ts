/** Generate free Web Push VAPID credentials. Run once and copy to .env. */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("Add these server environment variables:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:your-email@example.com");
console.log("\nThe public key is intentionally public; keep the private key secret.");
