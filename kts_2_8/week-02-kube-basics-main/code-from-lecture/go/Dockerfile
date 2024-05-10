FROM golang:1.17.3-alpine AS builder

WORKDIR /code
COPY go.mod .
COPY main.go .
RUN go build -o /bin/server .

FROM alpine
COPY --from=builder /bin/server /bin/server

ENV SERVER_BIND_ADDR ":8000"
ENTRYPOINT [ "/bin/server" ]
