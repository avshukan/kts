docker run -dp 127.0.0.1:8899:8899 --name kts_1_1 kts_1_1

Для того, чтобы в Mercury появился Kubeconfig выполняем команду merctl kubeconfig

kubectl apply -f ns.yaml

docker pull vaultwarden/server:latest
kind load docker-image vaultwarden/server:latest
kubectl apply -f vaultwarden.yaml

docker pull postgres
kind load docker-image postgres
kubectl apply -f pg.yaml

kubectl get deployments
kubectl get deployments --namespace vaultwarden
kubectl get pods
kubectl get pods --namespace vaultwarden -o wide

kubectl describe pod warden-db-postgres-64f9c5594c-hh4vg

kubectl port-forward myapp-5dfbd674d7-r7blb 9000:8000

kubectl port-forward warden-db-76d484d4d5-sp599 54321:5432

kubectl expose deployment vaultwarden --type=LoadBalancer --name=warden-service --namespace=vaultwarden
kubectl expose deployment vaultwarden --type=NodePort --name=warden-service --namespace=vaultwarden

kubectl get services --namespace=vaultwarden
kubectl get services -A

kubectl apply -f nodeport.yaml

user@MacBook-Pro-user kts_2_8 % kubectl expose deployment warden --type=LoadBalancer --name=warden-service
service/warden-service exposed
user@MacBook-Pro-user kts_2_8 % kubectl get services -A                                                   
NAMESPACE     NAME             TYPE           CLUSTER-IP     EXTERNAL-IP   PORT(S)                  AGE
default       kubernetes       ClusterIP      10.96.0.1      <none>        443/TCP                  34d
default       warden-service   LoadBalancer   10.96.77.236   <pending>     80:30535/TCP             2m53s
kube-system   kube-dns         ClusterIP      10.96.0.10     <none>        53/UDP,53/TCP,9153/TCP   34d


