import os

BLOCK_SIZE = 8
ROUNDS = 8
SBOX = [0xE, 0x4, 0xD, 0x1, 0x2, 0xF, 0xB, 0x8, 0x3, 0xA, 0x6, 0xC, 0x5, 0x9, 0x0, 0x7]

def substitute_nibbles(block):
    res = 0
    for i in range(16):
        nibble = (block >> (i * 4)) & 0xF
        res |= (SBOX[nibble] << (i * 4))
    return res

def permute(block):
    MASK64 = 0xFFFFFFFFFFFFFFFF
    return ((block << 13) | (block >> 51)) & MASK64

def key_schedule(master_key):
    MASK64 = 0xFFFFFFFFFFFFFFFF
    keys = []
    k = master_key & MASK64
    for r in range(ROUNDS + 1):
        keys.append(k)
        k = ((k << 7) | (k >> 57)) & MASK64
        k ^= ((r + 1) * 0x9e3779b97f4a7c15) & MASK64
    return keys

def encrypt_block(block, key):
    MASK64 = 0xFFFFFFFFFFFFFFFF
    subkeys = key_schedule(key)
    state = block & MASK64
    for r in range(ROUNDS):
        state ^= subkeys[r]
        state = substitute_nibbles(state)
        state = permute(state)
    state ^= subkeys[ROUNDS]
    return state & MASK64

def derive_key(key_material):
    if isinstance(key_material, str):
        key_material = key_material.encode('utf-8')
    acc = bytearray(BLOCK_SIZE)
    for i, b in enumerate(key_material):
        acc[i % BLOCK_SIZE] ^= b
    return int.from_bytes(acc, 'big')

def pad(data):
    pad_len = BLOCK_SIZE - (len(data) % BLOCK_SIZE)
    return data + bytes([pad_len] * pad_len)

def cbc_mac(message, key_material):
    key = derive_key(key_material)
    if isinstance(message, str):
        message = message.encode('utf-8')
    padded = pad(message)
    prev_block = 0
    for i in range(0, len(padded), BLOCK_SIZE):
        chunk = padded[i:i+BLOCK_SIZE]
        block_int = int.from_bytes(chunk, 'big')
        xored = prev_block ^ block_int
        prev_block = encrypt_block(xored, key)
    return f"{prev_block:016x}"
