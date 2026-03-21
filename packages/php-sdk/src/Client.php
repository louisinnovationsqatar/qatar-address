<?php

namespace QatarAddress;

use GuzzleHttp\Client as HttpClient;
use GuzzleHttp\Exception\RequestException;

class Client
{
    private HttpClient $http;
    private string $baseUrl;

    public function __construct(array $config = [])
    {
        $this->baseUrl = rtrim($config['baseUrl'] ?? 'https://api.qataraddress.com', '/');
        $this->http = new HttpClient([
            'base_uri' => $this->baseUrl,
            'timeout' => $config['timeout'] ?? 10,
            'headers' => ['Accept' => 'application/json'],
        ]);
    }

    public function getZones(int $page = 1, int $limit = 50): array
    {
        return $this->get("/api/v1/zones?page={$page}&limit={$limit}");
    }

    public function getZone(int $zone): array
    {
        return $this->get("/api/v1/zones/{$zone}");
    }

    public function getStreets(int $zone, int $page = 1, int $limit = 50): array
    {
        return $this->get("/api/v1/zones/{$zone}/streets?page={$page}&limit={$limit}");
    }

    public function getBuildings(int $zone, int $street, int $page = 1, int $limit = 50): array
    {
        return $this->get("/api/v1/zones/{$zone}/streets/{$street}/buildings?page={$page}&limit={$limit}");
    }

    public function locate(int $zone, int $street, int $building): array
    {
        $response = $this->get("/api/v1/locate/{$zone}/{$street}/{$building}");
        return $response['data'];
    }

    public function validate(int $zone, ?int $street = null, ?int $building = null): array
    {
        $params = ['zone' => $zone];
        if ($street !== null) $params['street'] = $street;
        if ($building !== null) $params['building'] = $building;
        $query = http_build_query($params);
        $response = $this->get("/api/v1/validate?{$query}");
        return $response['data'];
    }

    public function search(string $query, ?string $lang = null, ?string $type = null): array
    {
        $params = ['q' => $query];
        if ($lang) $params['lang'] = $lang;
        if ($type) $params['type'] = $type;
        $queryString = http_build_query($params);
        return $this->get("/api/v1/search?{$queryString}");
    }

    public function reverse(float $lat, float $lng, int $radius = 200): array
    {
        $response = $this->get("/api/v1/reverse?lat={$lat}&lng={$lng}&radius={$radius}");
        return $response['data'];
    }

    public function contribute(array $data): array
    {
        $response = $this->post('/api/v1/contribute', $data);
        return $response['data'];
    }

    public function health(): array
    {
        $response = $this->get('/api/v1/health');
        return $response['data'];
    }

    public function stats(): array
    {
        $response = $this->get('/api/v1/stats');
        return $response['data'];
    }

    private function get(string $path): array
    {
        try {
            $response = $this->http->get($path);
            return json_decode($response->getBody()->getContents(), true);
        } catch (RequestException $e) {
            $this->handleError($e);
        }
    }

    private function post(string $path, array $data): array
    {
        try {
            $response = $this->http->post($path, ['json' => $data]);
            return json_decode($response->getBody()->getContents(), true);
        } catch (RequestException $e) {
            $this->handleError($e);
        }
    }

    private function handleError(RequestException $e): never
    {
        $body = [];
        if ($e->hasResponse()) {
            $body = json_decode($e->getResponse()->getBody()->getContents(), true) ?? [];
        }
        $code = $body['error']['code'] ?? 'SERVER_ERROR';
        $message = $body['error']['message'] ?? $e->getMessage();
        $statusCode = $e->hasResponse() ? $e->getResponse()->getStatusCode() : 500;

        throw new QatarAddressException($message, $statusCode, $code, $e);
    }
}
