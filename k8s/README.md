# Paystream on Kubernetes (Week 12 + Week 13)

Run the whole app on a local Minikube cluster. Images are built locally and
loaded into Minikube (no registry needed).

## One-time per cluster

```bash
minikube start
minikube addons enable ingress            # Week 13: the Ingress controller

docker build -t paystream-backend:v2 ./backend
docker build -t paystream-frontend:v2 ./frontend
minikube image load paystream-backend:v2
minikube image load paystream-frontend:v2

# map the Ingress host (Week 13):
echo "$(minikube ip) paystream.local" | sudo tee -a /etc/hosts
```

## Deploy

```bash
kubectl apply -f k8s/

kubectl rollout status deploy/paystream-postgres
kubectl exec -i deploy/paystream-postgres -- psql -U paystream -d paystream < db/schema.sql
kubectl exec -i deploy/paystream-postgres -- psql -U paystream -d paystream < db/seed.sql

kubectl get pods
# open the app via the Ingress:
open http://paystream.local     # (or just visit it in a browser)
```

## What is here

| File           | Declares                                                      |
|----------------|--------------------------------------------------------------|
| configmap.yaml | Non-secret config (ports, URLs, TTL) as a ConfigMap          |
| secret.yaml    | DB password + DATABASE_URL as a Secret (placeholder only)    |
| postgres.yaml  | PostgreSQL Deployment + Service + a PersistentVolumeClaim     |
| redis.yaml     | Redis Deployment + Service                                   |
| api.yaml       | Wallet API Deployment (2 replicas) + Service                 |
| web.yaml       | Frontend Deployment (2 replicas) + ClusterIP Service         |
| ingress.yaml   | Ingress front door at http://paystream.local                 |

Config and credentials are externalised: pods read them from the ConfigMap and
Secret, not from hard-coded values. Postgres now has a volume, so its data
survives a pod restart.

> The Secret here is base64, which is encoding, not encryption. A real secret is
> created out-of-band and never committed. Week 18 moves it to AWS Secrets Manager.

## Ship a new version (rolling update)

```bash
docker build -t paystream-backend:v3 ./backend && minikube image load paystream-backend:v3
kubectl set image deploy/paystream-api api=paystream-backend:v3
kubectl rollout status deploy/paystream-api      # watch it replace pods gradually
kubectl rollout undo deploy/paystream-api        # roll back if needed
```

## Tear down

```bash
kubectl delete -f k8s/      # removes the app; the PVC (and its data) is kept unless you delete it
minikube stop               # or: minikube delete  (removes the cluster and the volume)
```
