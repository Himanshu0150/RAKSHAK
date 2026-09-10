import socket
import ssl

host = "ac-q0w3mcp-shard-00-00.eyjoi6q.mongodb.net"

context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
context.minimum_version = ssl.TLSVersion.TLSv1_3
context.maximum_version = ssl.TLSVersion.TLSv1_3
context.check_hostname = False
context.verify_mode = ssl.CERT_NONE

try:
    with socket.create_connection((host, 27017), timeout=10) as sock:
        with context.wrap_socket(sock, server_hostname=host) as ssock:
            print("TLS 1.3 CONNECTION: SUCCESS")
            print("TLS VERSION:", ssock.version())
            print("CIPHER:", ssock.cipher())
except Exception as e:
    print("TLS 1.3 CONNECTION: FAILED")
    print(type(e).__name__, str(e))
