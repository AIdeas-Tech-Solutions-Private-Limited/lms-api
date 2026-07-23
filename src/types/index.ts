export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthRequest extends Express.Request {
  user?: JwtPayload;
}
