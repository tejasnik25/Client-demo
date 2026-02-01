# Copy-Trade Application Deployment Guide

## 1. Executive Summary

For a financial application requiring **High Traffic handling**, **100% Uptime**, and **Top-Tier Security**, we strongly recommend the **AWS High-Availability Architecture**. While options like Vercel are easier, and Hostinger is cheaper, only a custom AWS architecture provides the control and redundancy necessary for a mission-critical trading platform.

---

## 2. Comparison of Deployment Options

| Feature | **AWS (Recommended)** | **Vercel + AWS RDS** | **Hostinger VPS** |
| :--- | :--- | :--- | :--- |
| **Best For** | Enterprise, High Traffic, 24/7 Uptime | Ease of use, Frontend-heavy apps | Budget / Hobby projects |
| **Traffic Handling** | **Unlimited** (Auto-Scaling) | **High** (Serverless) | **Low** (Fixed resources) |
| **Reliability** | ⭐⭐⭐⭐⭐ (Redundant Servers) | ⭐⭐⭐⭐⭐ (Global Edge) | ⭐⭐ (Single Point of Failure) |
| **Security** | ⭐⭐⭐⭐⭐ (Private VPCs, WAF) | ⭐⭐⭐⭐ (Managed) | ⭐⭐ (Manual Config Required) |
| **Est. Cost** | **$80 - $150 / month** | **$20 - $50 / month** | **$5 - $10 / month** |

---

## 3. The Recommended Plan: AWS High-Availability

### Architecture Overview
1.  **Load Balancer (ALB):** Distributes incoming traffic across multiple servers.
2.  **Auto Scaling Group (ASG):** Automatically adds/removes servers based on traffic load.
3.  **EC2 Instances:** The compute nodes running your Next.js application.
4.  **Amazon RDS (Multi-AZ):** Managed MySQL database with a standby replica for failover.
5.  **S3 Storage:** Stores user uploads and static assets safely off-server.

### Estimated Pricing Breakdown
| Service | Configuration | Monthly Cost (Est.) |
| :--- | :--- | :--- |
| **EC2 (App Servers)** | 2x `t3.small` (2 vCPU, 2GB RAM) | ~$30.00 |
| **Load Balancer** | 1x Application Load Balancer | ~$18.00 |
| **RDS (Database)** | `db.t3.micro` (Multi-AZ Enabled) | ~$30.00 |
| **S3 (Storage)** | Standard Storage | ~$1.00 |
| **Route53** | DNS Hosting | $0.50 |
| **Total** | | **~$80 - $90 / month** |

---

## 4. Step-by-Step Implementation Guide

### Phase 1: Preparation
1.  **Security Check:** Ensure no hardcoded passwords exist in `src/lib/auth-options.ts`.
2.  **Environment Variables:** Prepare your production `.env` values (DB_HOST, S3_KEYS, etc.).
3.  **Health Check Endpoint:** Ensure `/api/health` exists and returns `200 OK`.

### Phase 2: Network & Security Setup
1.  **Create Security Groups:**
    *   `ALB-SG`: Allow HTTPS (443) from Anywhere (`0.0.0.0/0`).
    *   `App-SG`: Allow HTTP (3000) **ONLY** from `ALB-SG`. Allow SSH (22) from your IP.
    *   `DB-SG`: Allow MySQL (3306) **ONLY** from `App-SG`.
2.  **VPC Config:** Ensure RDS is placed in a **Private Subnet** (no public IP).

### Phase 3: Database Setup (RDS)
1.  Go to **RDS Console** -> **Create Database**.
2.  Select **MySQL** -> **Production Template**.
3.  Enable **Multi-AZ Deployment** (Critical for uptime).
4.  Connect it to the `DB-SG` security group.
5.  **Note:** Save the Endpoint URL, Username, and Password immediately.

### Phase 4: Application Server Setup (EC2)
1.  Launch an **Ubuntu 22.04** instance (`t3.small`).
2.  SSH in and install dependencies:
    ```bash
    sudo apt update && sudo apt install -y nodejs npm git nginx
    ```
3.  Clone your repo and build:
    ```bash
    git clone [your-repo-url]
    cd [repo-name]
    npm install
    npm run build
    ```
4.  Start with **PM2**:
    ```bash
    npm install -g pm2
    pm2 start npm --name "next-app" -- start
    ```
5.  **Create Image (AMI):** Once working, save this instance as an Image (AMI) to use for Auto Scaling.

### Phase 5: Load Balancing & Auto Scaling
1.  **Target Group:** Create a target group pointing to Port 3000 on your instances.
2.  **Load Balancer:** Create an ALB listening on Port 443 (HTTPS) and forwarding to your Target Group.
3.  **Auto Scaling Group:** Create an ASG using your Custom Image (AMI). Set Min: 2, Max: 10. Configure scaling policy to add servers if CPU > 50%.

---

## 5. Critical Infrastructure FAQ

### Q: What if the disk gets full?
**A:** In this architecture, servers are disposable.
1.  **Store Files on S3:** Ensure `STORAGE_MODE=s3` is set in your `.env`. This prevents uploads from filling the disk.
2.  **Logs:** Use AWS CloudWatch Agent to stream logs off the server.
3.  **If Full:** The Auto Scaling Group will detect the unhealthy server, terminate it, and launch a fresh one with an empty disk.

### Q: Do I need an Elastic IP?
**A: No.**
You should **not** assign Elastic IPs to your application servers. The Load Balancer (ALB) handles all public traffic. This hides your servers from the internet, significantly increasing security.

### Q: How do I keep the database secure?
**A:**
1.  **Private Subnet:** Place the RDS instance in a subnet that has **no Internet Gateway**.
2.  **Security Groups:** Whitelist ONLY the Application Security Group ID. Deny all other IP addresses.
3.  **SSL:** Enforce `DB_SSL=true` in your application connection string.

---

## 6. Pre-Deployment Security Checklist
- [ ] **Hardcoded Secrets Removed:** Checked `auth-options.ts` and others.
- [ ] **Database SSL:** Enabled in `src/db/db.ts`.
- [ ] **S3 Bucket:** Public access blocked (except for specific read paths).
- [ ] **Admin Password:** Changed from default `admin123` to a strong environment variable.
