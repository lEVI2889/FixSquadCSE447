import rsa

RSA_PREFIX = "RSA:"

def rsa_encrypt_text(plaintext, pub_key):
    encoded = plaintext.encode('utf-8')
    chunks = []
    chunk_size = 30
    
    for i in range(0, len(encoded), chunk_size):
        chunk = encoded[i:i+chunk_size]
        m = int.from_bytes(chunk, 'big')
        c = rsa.encrypt(m, pub_key)
        chunks.append(f"{len(chunk)}:{c}")
        
    return RSA_PREFIX + ",".join(chunks)

def rsa_decrypt_text(ciphertext_str, priv_key):
    if not ciphertext_str.startswith(RSA_PREFIX):
        return ciphertext_str
        
    payload = ciphertext_str[len(RSA_PREFIX):]
    chunks = payload.split(',')
    
    decrypted_bytes = bytearray()
    for chunk in chunks:
        if not chunk: continue
        length_str, c_str = chunk.split(':')
        length = int(length_str)
        c = int(c_str)
        
        m = rsa.decrypt(c, priv_key)
        m_bytes = m.to_bytes(length, 'big')
        decrypted_bytes.extend(m_bytes)
        
    return decrypted_bytes.decode('utf-8')
