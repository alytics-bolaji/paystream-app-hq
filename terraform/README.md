# Paystream infrastructure as code (Terraform)

Defines the Kenya **staging estate** -- a VPC, a public subnet, an internet
gateway, a route table, a security group, and the Paystream EC2 instance -- so
it can be rebuilt from code instead of being clicked together in the console
(and lost when someone deletes it by hand).

## Prerequisites
- An AWS account, with credentials configured (`aws configure`, or env vars).
- An existing **EC2 key pair** in your chosen region, for SSH.
- Terraform installed (`terraform version`).

## The workflow
```bash
cp terraform.tfvars.example terraform.tfvars   # fill in key_name and my_ip
terraform init      # download the AWS provider
terraform fmt       # tidy the files
terraform validate  # check the config is well-formed
terraform plan      # preview exactly what will be created
terraform apply     # create it for real (type: yes)
terraform output    # the instance IP and a ready-made ssh command
# ... when you are finished ...
terraform destroy   # tear the WHOLE estate down (type: yes) -- stops the bill
```

## Cost and teardown
A `t3.micro` is free-tier eligible, but **run `terraform destroy` when you are
done** so nothing keeps running. Everything this creates comes down with that
one command, because it is all defined here.

## State
`terraform.tfstate` records what Terraform built and maps it to this code. It is
gitignored because it can contain sensitive values. Week 17 moves it to shared
remote state in S3 with locking.
