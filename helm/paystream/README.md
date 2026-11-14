# Paystream Helm chart

One chart that deploys the whole app (frontend, API, PostgreSQL, Redis, Ingress),
configured per environment by a values file instead of three hand-copied YAML folders.

## Install / upgrade

```bash
# dev
helm upgrade --install paystream ./helm/paystream -f helm/paystream/values-dev.yaml
# prod
helm upgrade --install paystream ./helm/paystream -f helm/paystream/values-prod.yaml
```

`helm upgrade --install` installs on the first run and upgrades on later runs, so the
same command works every time.

## See what it will render (without applying)

```bash
helm template paystream ./helm/paystream -f helm/paystream/values-prod.yaml
```

## Upgrade, roll back, history

```bash
helm upgrade paystream ./helm/paystream --set image.web.tag=v3   # ship a change
helm history paystream                                           # see every revision
helm rollback paystream 1                                        # go back to revision 1
```

## What changes per environment

| Value            | dev            | prod               |
|------------------|----------------|--------------------|
| replicas.api     | 1              | 3                  |
| replicas.web     | 1              | 2                  |
| ingress.host     | paystream.local| paystream.ke       |
| db.storage       | 1Gi            | 5Gi                |
| api.corsOrigin   | *              | https://paystream.ke |

The database password is a dev default in values.yaml; in production pass it with
`--set db.password=...` or source it from a real secrets manager (Week 18).

> Note: this chart creates the same resource names as the raw k8s/ manifests, so install
> one or the other, not both at once.
