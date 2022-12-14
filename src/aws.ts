import {
  EC2Client,
  CancelSpotInstanceRequestsCommand,
  DescribeInstancesCommand,
  DescribeSpotInstanceRequestsCommand,
  RequestSpotInstancesCommand,
  TerminateInstancesCommand
} from '@aws-sdk/client-ec2'

const max_retry = 60
const wait_time = 5000

async function wait(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

export async function RequestSpotInstance(
  client: EC2Client,
  name: string,
  ami: string,
  instanceType: string,
  securityGroup: string,
  sshKeyName: string,
  validUntil: Date,
  availabilityZone?: string
): Promise<string> {
  const command = new RequestSpotInstancesCommand({
    AvailabilityZoneGroup: availabilityZone,
    ValidUntil: validUntil,
    InstanceCount: 1,
    LaunchSpecification: {
      SecurityGroups: [securityGroup],
      BlockDeviceMappings: [
        {
          DeviceName: '/dev/sda1',
          Ebs: {
            DeleteOnTermination: true,
            VolumeSize: 8,
            VolumeType: 'gp2',
            Encrypted: false
          }
        }
      ],
      ImageId: ami,
      InstanceType: instanceType,
      KeyName: sshKeyName,
      Placement: {
        AvailabilityZone: availabilityZone,
        Tenancy: 'default'
      },
      Monitoring: {
        Enabled: false
      }
    },
    TagSpecifications: [
      {
        ResourceType: 'spot-instances-request',
        Tags: [
          {
            Key: 'Name',
            Value: name
          }
        ]
      }
    ]
  })

  const response = await client.send(command)

  return response.SpotInstanceRequests?.[0].SpotInstanceRequestId ?? ''
}

export async function WaitForspotInstance(
  client: EC2Client,
  requestID: string
): Promise<string> {
  const command = new DescribeSpotInstanceRequestsCommand({
    SpotInstanceRequestIds: [requestID]
  })

  for (let retry = 0; retry < max_retry; retry++) {
    const response = await client.send(command)
    if (
      response.SpotInstanceRequests?.[0].InstanceId != null &&
      response.SpotInstanceRequests?.[0].InstanceId !== ''
    ) {
      return response.SpotInstanceRequests?.[0].InstanceId
    }
    await wait(wait_time)
  }

  return ''
}

export async function GetPublicDnsName(
  client: EC2Client,
  instanceID: string
): Promise<string> {
  const command = new DescribeInstancesCommand({
    InstanceIds: [instanceID]
  })

  for (let retry = 0; retry < max_retry; retry++) {
    const response = await client.send(command)

    if (
      response.Reservations?.[0].Instances?.[0].PublicDnsName != null &&
      response.Reservations?.[0].Instances?.[0].PublicDnsName !== ''
    ) {
      return response.Reservations?.[0].Instances?.[0].PublicDnsName ?? ''
    }
    await wait(wait_time)
  }

  return ''
}

export async function TerminateInstance(
  client: EC2Client,
  instanceID: string
): Promise<void> {
  const command = new TerminateInstancesCommand({
    InstanceIds: [instanceID]
  })

  await client.send(command)
}

export async function CancelSpotInstanceRequest(
  client: EC2Client,
  requestID: string
): Promise<void> {
  const command = new CancelSpotInstanceRequestsCommand({
    SpotInstanceRequestIds: [requestID]
  })

  await client.send(command)
}
