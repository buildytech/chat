FROM golang:1.22-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
COPY . .
RUN CGO_ENABLED=1 go build -o /out/context-serve .

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /var/lib/context-serve
COPY --from=build /out/context-serve /usr/local/bin/context-serve
ENV CONTEXT_SERVE_ADDR=127.0.0.1:8090
ENV PAGE_STORE_PATH=/var/lib/context-serve/pages.sqlite
ENTRYPOINT ["/usr/local/bin/context-serve"]
