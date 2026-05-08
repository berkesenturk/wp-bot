variable "aws_region" {
  default = "us-east-1"
}

variable "github_repo" {
  description = "GitHub owner/repo (e.g. berkesenturk11/wp-bot)"
}

variable "admin_ip" {
  description = "Your public IP in CIDR notation for SSH + port 3000 (e.g. 1.2.3.4/32)"
}

variable "api_key" {
  description = "LLM API key — written to /etc/wp-bot.env on EC2, never stored in state plaintext"
  sensitive   = true
}

variable "phone_number" {
  description = "WhatsApp phone number for initial pairing (e.g. 905551234567)"
}
