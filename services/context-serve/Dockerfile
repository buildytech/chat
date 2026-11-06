FROM golang:1.22-bookworm AS build
WORKDIR /src
COPY go.mod ./
COPY main.go ./
RUN go build -o /out/context-serve .

FROM debian:bookworm-slim
COPY --from=build /out/context-serve /usr/local/bin/context-serve
ENTRYPOINT ["/usr/local/bin/context-serve"]
