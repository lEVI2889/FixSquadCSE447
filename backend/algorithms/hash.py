import os

SALT_BYTES = 16
HASH_BYTES = 32
DEFAULT_ITER = 10000
BLOCK_BITS = 256
BLOCK_MASK = (1 << BLOCK_BITS) - 1

K = [
    0x6a09e667bb67ae85, 0x3c6ef372a54ff53a,
    0x510e527f9b05688c, 0x1f83d9abfb41bd6b,
    0x5be0cd19137e2179, 0xcbbb9d5dc1059ed8
]

def rotate_left(val, shift, bits=64):
    return ((val << shift) | (val >> (bits - shift))) & ((1 << bits) - 1)

def custom_compress(state):
    a = (state >> 192) & 0xFFFFFFFFFFFFFFFF
    b = (state >> 128) & 0xFFFFFFFFFFFFFFFF
    c = (state >> 64)  & 0xFFFFFFFFFFFFFFFF
    d = state          & 0xFFFFFFFFFFFFFFFF

    for i in range(6):
        a = (a + b + K[i]) & 0xFFFFFFFFFFFFFFFF
        b = rotate_left(b ^ a, 13)
        c = (c + d) & 0xFFFFFFFFFFFFFFFF
        d = rotate_left(d ^ c, 29)
        
        a = (a + d) & 0xFFFFFFFFFFFFFFFF
        b = rotate_left(b ^ a, 23)
        c = (c + b) & 0xFFFFFFFFFFFFFFFF
        d = rotate_left(d ^ c, 17)

    new_state = (a << 192) | (b << 128) | (c << 64) | d
    return (state ^ new_state) & BLOCK_MASK

def hash_password(password, iterations=DEFAULT_ITER):
    salt = os.urandom(SALT_BYTES)
    
    pwd_bytes = password.encode('utf-8')
    pwd_int = int.from_bytes(pwd_bytes.ljust(32, b'\x00')[:32], 'big')
    salt_int = int.from_bytes(salt.ljust(32, b'\x00')[:32], 'big')
    
    state = 0x736f6d6570736575646f72616e646f6d696e697469616c7374617465313233
    
    for _ in range(iterations):
        state = custom_compress(state ^ pwd_int ^ salt_int)
        
    hash_hex = f"{state:064x}"
    salt_hex = salt.hex()
    return f"{iterations}${salt_hex}${hash_hex}"
