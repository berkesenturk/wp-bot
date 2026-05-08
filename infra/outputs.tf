output "ec2_host" {
  description = "Elastic IP — add as EC2_HOST GitHub Actions secret"
  value       = aws_eip.wp_bot.public_ip
}

output "ec2_ssh_key" {
  description = "Private SSH key PEM — add as EC2_SSH_KEY GitHub Actions secret"
  value       = tls_private_key.wp_bot.private_key_pem
  sensitive   = true
}

output "ssh_command" {
  description = "Ready-to-use SSH command"
  value       = "ssh -i <(terraform output -raw ec2_ssh_key) ec2-user@${aws_eip.wp_bot.public_ip}"
}
