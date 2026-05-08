param(
    [string]$Topic,
    [int]$MaxMessages = 10,
    [switch]$FromBeginning,
    [switch]$ListTopics
)

$ErrorActionPreference = "Stop"

if ($ListTopics) {
    kubectl exec deployment/biozephyra-kafka -- sh -lc "/opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list"
    exit $LASTEXITCODE
}

if (-not $Topic) {
    throw "Provide -Topic or use -ListTopics."
}

$fromBeginningFlag = if ($FromBeginning) { '--from-beginning' } else { '' }
$command = "/opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic $Topic $fromBeginningFlag --max-messages $MaxMessages"
kubectl exec deployment/biozephyra-kafka -- sh -lc $command
exit $LASTEXITCODE