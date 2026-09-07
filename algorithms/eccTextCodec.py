import os
import ecc

ECC_PREFIX = "ECC:"

def ecc_encrypt_text(plaintext, pub_key):
    encoded = plaintext.encode('utf-8')
    chunks = []
    chunk_size = 7
    
    for i in range(0, len(encoded), chunk_size):
        chunk = encoded[i:i+chunk_size]
        m = int.from_bytes(chunk, 'big')
        
        k = int.from_bytes(os.urandom(7), 'big') % ecc.n
        if k == 0: k = 1
        
        C1 = ecc.scalar_multiply(k, ecc.G)
        S = ecc.scalar_multiply(k, pub_key)
        
        c2 = (m + S[0]) % ecc.p
        chunks.append(f"{len(chunk)}:{C1[0]},{C1[1]},{c2}")
        
    return ECC_PREFIX + ";".join(chunks)

def ecc_decrypt_text(ciphertext_str, priv_key):
    if not ciphertext_str.startswith(ECC_PREFIX):
        return ciphertext_str
        
    payload = ciphertext_str[len(ECC_PREFIX):]
    chunks = payload.split(';')
    
    decrypted_bytes = bytearray()
    for chunk in chunks:
        if not chunk: continue
        length_str, data = chunk.split(':')
        length = int(length_str)
        c1x_str, c1y_str, c2_str = data.split(',')
        
        C1 = (int(c1x_str), int(c1y_str))
        c2 = int(c2_str)
        
        S = ecc.scalar_multiply(priv_key, C1)
        m = (c2 - S[0]) % ecc.p
        
        m_bytes = m.to_bytes(length, 'big')
        decrypted_bytes.extend(m_bytes)
        
    return decrypted_bytes.decode('utf-8')
