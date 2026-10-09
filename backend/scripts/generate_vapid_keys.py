"""Generate a VAPID key pair suitable for the Havan server environment variables."""

import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


private_key = ec.generate_private_key(ec.SECP256R1())
private_der = private_key.private_bytes(
    encoding=serialization.Encoding.DER,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption(),
)
public_raw = private_key.public_key().public_bytes(
    encoding=serialization.Encoding.X962,
    format=serialization.PublicFormat.UncompressedPoint,
)
public_key = base64.urlsafe_b64encode(public_raw).decode("ascii").rstrip("=")
private_key_b64 = base64.b64encode(private_der).decode("ascii")
print("VAPID_PUBLIC_KEY=" + public_key)
print("VAPID_PRIVATE_KEY=" + private_key_b64)
