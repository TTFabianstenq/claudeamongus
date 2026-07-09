import { jwtVerify, SignJWT } from "jose";

export interface SocketIdentity {
  /** database user id, or a per-browser guest id prefixed with "guest:" */
  sub: string;
  name: string;
  guest: boolean;
}

const ISSUER = "crewfall";
const AUDIENCE = "crewfall-realtime";
const TOKEN_TTL = "10m";

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set — required to sign realtime tokens");
  }
  return new TextEncoder().encode(secret);
}

export async function signSocketToken(identity: SocketIdentity): Promise<string> {
  return new SignJWT({ name: identity.name, guest: identity.guest })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(identity.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secretKey());
}

export async function verifySocketToken(token: string): Promise<SocketIdentity | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.sub !== "string" || typeof payload.name !== "string") return null;
    return {
      sub: payload.sub,
      name: payload.name,
      guest: payload.guest === true,
    };
  } catch {
    return null;
  }
}
