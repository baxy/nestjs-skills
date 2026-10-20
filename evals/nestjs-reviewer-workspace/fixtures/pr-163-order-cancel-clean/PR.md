# PR #163: Cancel orders, signup duplicate check, session cleanup

Adds `POST /orders/:id/cancel`, the duplicate-email check on signup, the order entity changes,
a nightly cleanup of expired refresh tokens (3 replicas on Kubernetes, behind an NGINX ingress), and the app wiring.
Changed files: everything under `src/` and `test/` in this folder. Files not shown are unchanged.
