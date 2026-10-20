# PR #157: Refresh token purge, catalog cache, stock reservation listener

Adds the refresh token entity and a nightly purge of expired tokens, Redis caching for the catalog,
and a listener that reserves stock when an order is created. The service runs as 3 replicas on Kubernetes.
Changed files: everything under `src/` in this folder.
