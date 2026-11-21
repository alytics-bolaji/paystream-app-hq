# outputs.tf -- the useful values Terraform prints after an apply.
output "instance_public_ip" {
  description = "Public IP of the Paystream staging instance"
  value       = aws_instance.paystream.public_ip
}

output "vpc_id" {
  description = "The id of the staging VPC"
  value       = aws_vpc.staging.id
}

output "ssh_command" {
  description = "Ready-made command to SSH into the instance"
  value       = "ssh -i ${var.key_name}.pem ubuntu@${aws_instance.paystream.public_ip}"
}
