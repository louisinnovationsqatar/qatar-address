<?php

namespace QatarAddress;

class QatarAddressException extends \RuntimeException
{
    private string $errorCode;

    public function __construct(string $message, int $statusCode, string $errorCode, ?\Throwable $previous = null)
    {
        parent::__construct($message, $statusCode, $previous);
        $this->errorCode = $errorCode;
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }

    public function getStatusCode(): int
    {
        return $this->getCode();
    }
}
