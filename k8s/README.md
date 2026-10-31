# Paystream on Kubernetes (Week 12)

Run the whole app on a local Minikube cluster as Deployments behind Services.
Images are built locally and loaded into Minikube (no registry needed).

## One-time per cluster

```bash
minikube start

# build the app images and load them into the cluster
docker build -t paystream-backend:v2 ./backend
docker build -t paystream-frontend:v2 ./frontend
minikube image load paystream-backend:v2
minikube image load paystream-frontend:v2
```

## Deploy

```bash
kubectl apply -f k8s/

# wait for postgres, then load the schema + seed into it:
kubectl rollout status deploy/paystream-postgres
kubectl exec -i deploy/paystream-postgres -- psql -U paystream -d paystream < db/schema.sql
kubectl exec -i deploy/paystream-postgres -- psql -U paystream -d paystream < db/seed.sql

kubectl get pods            # watch them become Ready
minikube service paystream-web --url   # open the URL it prints
```

## What is here

| File           | Declares                                              |
|----------------|-------------------------------------------------------|
| postgres.yaml  | PostgreSQL Deployment + Service (no volume yet)       |
| redis.yaml     | Redis Deployment + Service                            |
| api.yaml       | Wallet API Deployment (2 replicas) + Service          |
| web.yaml       | Frontend Deployment (2 replicas) + NodePort Service   |

Service names are DNS names in the cluster: the API reaches the data tier at
`paystream-postgres` / `paystream-redis`, and the frontend proxies `/api` to the
`paystream-api` Service. No `localhost` anywhere.

Not here yet (Week 13): a PersistentVolumeClaim for Postgres, a Secret for the
database password, a ConfigMap, and an Ingress.

## Tear down

```bash
kubectl delete -f k8s/      # remove the app; the cluster stays
minikube stop               # or: minikube delete  (removes the cluster)
```
