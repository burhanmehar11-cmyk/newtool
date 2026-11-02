/** SQL used to scope a transaction to one signed-in user. Shared with the database tests. */
export const USER_SCOPE_SQL = {
  role: "set local role authenticated",
  setUser: "select set_config('app.user_id', $1, true)",
} as const;
