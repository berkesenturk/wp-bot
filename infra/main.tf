terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
    tls = { source = "hashicorp/tls", version = "~> 4.0" }
  }
}

provider "aws" { region = var.aws_region }

# ── SSH key pair ──────────────────────────────────────────────────────────────
resource "tls_private_key" "wp_bot" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "wp_bot" {
  key_name   = "wp-bot-key"
  public_key = tls_private_key.wp_bot.public_key_openssh
}

# ── Security group ────────────────────────────────────────────────────────────
resource "aws_security_group" "wp_bot" {
  name        = "wp-bot-sg"
  description = "WhatsApp bot admin access"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Bot admin UI + pairing"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = [var.admin_ip]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── Amazon Linux 2023 AMI (latest x86_64) ─────────────────────────────────────
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

# ── EC2 t3.micro ──────────────────────────────────────────────────────────────
resource "aws_instance" "wp_bot" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = "t3.micro"
  key_name               = aws_key_pair.wp_bot.key_name
  vpc_security_group_ids = [aws_security_group.wp_bot.id]

  root_block_device {
    volume_size = 10   # 10 GB root + 20 GB data = 30 GB free-tier limit
    volume_type = "gp2"
  }

  # Runs once on first boot — installs Docker, mounts EBS, writes secrets
  user_data = <<-USERDATA
    #!/bin/bash
    set -e

    # Wait for EBS attachment to settle
    sleep 15

    curl -fsSL "https://raw.githubusercontent.com/${var.github_repo}/main/scripts/ec2-setup.sh" \
      -o /tmp/ec2-setup.sh

    bash /tmp/ec2-setup.sh "${var.github_repo}"

    # Overwrite the placeholder env file with real secrets
    cat > /etc/wp-bot.env <<ENV
API_KEY=${var.api_key}
PHONE_NUMBER=${var.phone_number}
ENV
    chmod 600 /etc/wp-bot.env
  USERDATA

  tags = { Name = "wp-bot" }
}

# ── EBS data volume (persistent app state, separate from root) ────────────────
resource "aws_ebs_volume" "wp_bot_data" {
  availability_zone = aws_instance.wp_bot.availability_zone
  size              = 20
  type              = "gp2"
  tags              = { Name = "wp-bot-data" }
}

resource "aws_volume_attachment" "wp_bot_data" {
  device_name  = "/dev/xvdf"
  volume_id    = aws_ebs_volume.wp_bot_data.id
  instance_id  = aws_instance.wp_bot.id
  force_detach = false
}

# ── Elastic IP ────────────────────────────────────────────────────────────────
resource "aws_eip" "wp_bot" {
  instance = aws_instance.wp_bot.id
  domain   = "vpc"
  tags     = { Name = "wp-bot-eip" }
}
