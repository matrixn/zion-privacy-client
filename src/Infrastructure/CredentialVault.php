<?php

namespace ZionPrivacy\Infrastructure;

final class CredentialVault
{
    private const PREFIX = 'v1:';

    public function encrypt(array $credentials): string
    {
        $key = $this->key();
        $iv = random_bytes(12);
        $tag = '';
        $ciphertext = openssl_encrypt(
            wp_json_encode($credentials),
            'aes-256-gcm',
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
        );

        if ($ciphertext === false) {
            throw new \RuntimeException('Unable to encrypt Zion Privacy credentials.');
        }

        return self::PREFIX.implode(':', [
            base64_encode($iv),
            base64_encode($tag),
            base64_encode($ciphertext),
        ]);
    }

    public function decrypt(?string $value): array
    {
        if (! is_string($value) || ! str_starts_with($value, self::PREFIX)) {
            return [];
        }

        $parts = explode(':', substr($value, strlen(self::PREFIX)));

        if (count($parts) !== 3) {
            return [];
        }

        $plaintext = openssl_decrypt(
            base64_decode($parts[2], true),
            'aes-256-gcm',
            $this->key(),
            OPENSSL_RAW_DATA,
            base64_decode($parts[0], true),
            base64_decode($parts[1], true),
        );

        $credentials = is_string($plaintext) ? json_decode($plaintext, true) : null;

        return is_array($credentials) ? $credentials : [];
    }

    private function key(): string
    {
        return hash('sha256', wp_salt('auth').wp_salt('secure_auth'), true);
    }
}
