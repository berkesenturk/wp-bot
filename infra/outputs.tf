output "ec2_host" {
  description = "Public IP — add as EC2_HOST GitHub Actions secret (update if instance is stopped/restarted)"
  value       = aws_instance.wp_bot.public_ip
}

output "ec2_ssh_key" {
  description = "Private SSH key PEM — add as EC2_SSH_KEY GitHub Actions secret"
  value       = tls_private_key.wp_bot.private_key_pem
  sensitive   = true
}

output "ssh_command" {
  description = "Ready-to-use SSH command"
  value       = "ssh -i <(terraform output -raw ec2_ssh_key) ec2-user@${aws_instance.wp_bot.public_ip}"
}
