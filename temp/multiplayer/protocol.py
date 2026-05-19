import json
import struct
import socket
from typing import Optional

def send_message(sock: socket.socket, message: dict):
    """Encodes a dictionary as JSON and sends it over the socket with a 4-byte length prefix."""
    try:
        data = json.dumps(message).encode('utf-8')
        length_prefix = struct.pack("!I", len(data))
        sock.sendall(length_prefix + data)
    except Exception as e:
        print(f"Error sending message: {e}")

def receive_message(sock: socket.socket) -> Optional[dict]:
    """Receives a 4-byte length prefix, then reads the JSON data of that length."""
    try:
        raw_msglen = recvall(sock, 4)
        if not raw_msglen:
            return None
        msglen = struct.unpack("!I", raw_msglen)[0]
        data = recvall(sock, msglen)
        if not data:
            return None
        return json.loads(data.decode('utf-8'))
    except ConnectionResetError:
        return None
    except Exception as e:
        print(f"Error receiving message: {e}")
        return None

def recvall(sock: socket.socket, n: int) -> Optional[bytes]:
    """Helper function to recv n bytes or return None if EOF is hit"""
    data = bytearray()
    while len(data) < n:
        try:
            packet = sock.recv(n - len(data))
            if not packet:
                return None
            data.extend(packet)
        except Exception:
            return None
    return bytes(data)
