-- Login and registration now trim and lowercase emails. Normalize existing rows
-- the same way, except when it would collide with another account: such a case
-- variant may be an account created through the old case-sensitive check and
-- must be reviewed by hand rather than fail the deployment.
UPDATE "User" AS u
SET "email" = lower(trim(u."email"))
WHERE u."email" <> lower(trim(u."email"))
  AND NOT EXISTS (
    SELECT 1 FROM "User" AS other
    WHERE other."id" <> u."id"
      AND lower(trim(other."email")) = lower(trim(u."email"))
  );
