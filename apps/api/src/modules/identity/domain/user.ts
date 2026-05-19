// The Identity bounded context's public User shape is the zod schema
// in packages/types. This file re-exports for in-module clarity and
// to keep the dependency direction explicit (modules depend on @bgreen/types).
export { UserSchema, type User } from "@bgreen/types";
