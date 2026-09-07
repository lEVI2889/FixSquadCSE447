import random

def gcd(a, b):
    while b:
        a, b = b, a % b
    return a

def ext_gcd(a, b):
    if a == 0:
        return b, 0, 1
    g, y, x = ext_gcd(b % a, a)
    return g, x - (b // a) * y, y

def mod_inverse(a, m):
    g, x, _ = ext_gcd(a, m)
    if g != 1:
        raise Exception('Modular inverse does not exist')
    return x % m

def is_prime(n, k=5):
    if n <= 1: return False
    if n <= 3: return True
    if n % 2 == 0 or n % 3 == 0: return False
    d = n - 1
    s = 0
    while d % 2 == 0:
        d //= 2
        s += 1
    for _ in range(k):
        a = random.randrange(2, n - 1)
        x = pow(a, d, n)
        if x == 1 or x == n - 1:
            continue
        for _ in range(s - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True

def generate_prime(bits):
    while True:
        p = random.getrandbits(bits)
        p |= (1 << bits - 1) | 1
        if is_prime(p):
            return p

def generate_keys(bits=256):
    p = generate_prime(bits // 2)
    q = generate_prime(bits // 2)
    n = p * q
    phi = (p - 1) * (q - 1)
    e = 65537
    d = mod_inverse(e, phi)
    return {'public': (e, n), 'private': (d, n)}

def encrypt(m, pub_key):
    e, n = pub_key
    return pow(m, e, n)

def decrypt(c, priv_key):
    d, n = priv_key
    return pow(c, d, n)
