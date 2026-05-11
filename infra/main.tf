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
    volume_size = 20   # 20 GB root — within free-tier limit
    volume_type = "gp2"
  }

  user_data = <<-USERDATA
    #!/bin/bash
    set -e
    curl -fsSL "https://raw.githubusercontent.com/${var.github_repo}/main/scripts/ec2-setup.sh" \
      -o /tmp/ec2-setup.sh

    bash /tmp/ec2-setup.sh "${var.github_repo}"

    # Write real API key
    cat > /etc/wp-bot.env <<ENV
API_KEY=${var.api_key}
ENV
    chmod 600 /etc/wp-bot.env
  USERDATA

  tags = { Name = "wp-bot" }
}
