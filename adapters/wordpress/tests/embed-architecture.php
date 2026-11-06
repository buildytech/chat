<?php
declare(strict_types=1);
// Structural regression only; browser runtime acceptance remains required.
$source = (string) file_get_contents(__DIR__ . '/../includes/class-admin.php');
foreach (['kit.start(', 'kitMod.start(', '/_app/immutable/entry/start.'] as $forbidden) {
    if (str_contains($source, $forbidden)) {
        throw new RuntimeException('Router boot reintroduced: ' . $forbidden);
    }
}
$entry = (string) file_get_contents(__DIR__ . '/../../../apps/chat-web/src/embed/wp-main.ts');
if (!str_contains($entry, 'mount(ChatApp, { target: root })')) {
    throw new RuntimeException('Missing explicit Svelte mount');
}
if (str_contains($entry, '$app/navigation')) {
    throw new RuntimeException('Embed must not import Kit navigation');
}
echo "EMBED_ARCHITECTURE_PASS (static only)\n";
