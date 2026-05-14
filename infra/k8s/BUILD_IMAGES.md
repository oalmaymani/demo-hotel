# بناء الصور للـ k8s على جهازك (k3s / kind / minikube)

## خيار 1: build محلي مع docker
من root:
```bash
docker build -t towseasons-backend:local apps/backend
docker build -t towseasons-frontend:local apps/frontend
```

ثم:
```bash
kubectl apply -f infra/k8s
```

> إذا تستخدم k3s وتبي الصور تظهر للكلاستر، غالباً docker المحلي يكفي.
> إذا تستخدم kind/minikube قد تحتاج `kind load docker-image ...` أو `minikube image load ...`
