# EC2 deploy notes

This project can deploy to a single EC2 instance with Docker and Docker Compose.

## Recommended minimum

- Ubuntu 22.04
- `t3.small` or larger
- 20 GB disk

`t3.micro` can be used for short-lived demos, but it is likely to be tight on memory.

## One-time server setup

SSH into the server and run:

```bash
chmod +x infra/ec2/setup-server.sh
./infra/ec2/setup-server.sh /opt/almawsimin-hotel
```

If you uploaded only this script first, you can also run it after cloning the repo manually.

## Nginx setup

To expose the app on port `80` through Nginx:

```bash
chmod +x infra/ec2/setup-nginx.sh
./infra/ec2/setup-nginx.sh almawsimin-hotel 54.144.90.155 3000 4000
```

Arguments:

- first argument: site name
- second argument: server name or public IP
- third argument: app port, defaults to `3000`
- fourth argument: backend API port, defaults to `4000`

## GitHub Secrets

Add these repository secrets:

- `EC2_HOST`: public IP or DNS of the server
- `EC2_USER`: SSH user, usually `ubuntu`
- `EC2_SSH_KEY`: private key contents for the deploy key
- `EC2_APP_DIR`: target directory on the server, for example `/opt/almawsimin-hotel`
- `EC2_PORT`: optional, defaults to `22`

## What deploy does

The GitHub Actions deploy workflow:

1. Connects to the server over SSH
2. Clones the repository if it is not already there
3. Checks out the pushed branch
4. Resets to the remote branch state
5. Runs:

```bash
docker compose -f infra/compose/docker-compose.yml up -d --build
```

## Networking

Recommended security group rules:

- `22` from your IP only
- `80` from anywhere
- `443` from anywhere

Keep `3000`, `4000`, and `5432` closed to the public internet for production use.
