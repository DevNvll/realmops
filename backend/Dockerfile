FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache gcc musl-dev

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=1 go build -o gsm ./cmd/server

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/gsm .

RUN mkdir -p /var/lib/gsm/db /var/lib/gsm/packs /var/lib/gsm/servers /var/lib/gsm/cache

EXPOSE 8080

CMD ["./gsm"]
