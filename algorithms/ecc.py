# Custom ECC Engine over a 63-bit prime field
p = 9223372036854775783
a = 0
b = 7
G = (5506626302227734366, 3267051002075881697)
n = 9223372036854775783

def mod_inverse(k, p):
    if k == 0:
        raise ZeroDivisionError('division by zero')
    if k < 0:
        return p - mod_inverse(-k, p)
    s, old_s = 0, 1
    t, old_t = 1, 0
    r, old_r = p, k
    while r != 0:
        quotient = old_r // r
        old_r, r = r, old_r - quotient * r
        old_s, s = s, old_s - quotient * s
        old_t, t = t, old_t - quotient * t
    return old_s % p

def point_add(P, Q):
    if P is None: return Q
    if Q is None: return P
    x1, y1 = P
    x2, y2 = Q
    if x1 == x2 and y1 != y2:
        return None
    if x1 == x2:
        m = (3 * x1 * x1 + a) * mod_inverse(2 * y1, p)
    else:
        m = (y1 - y2) * mod_inverse(x1 - x2, p)
    x3 = (m * m - x1 - x2) % p
    y3 = (m * (x1 - x3) - y1) % p
    return (x3, y3)

def scalar_multiply(k, P):
    R = None
    T = P
    while k:
        if k & 1:
            R = point_add(R, T)
        T = point_add(T, T)
        k >>= 1
    return R
