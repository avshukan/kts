FROM golang:1.17.3-alpine as builder
LABEL maintainer="avshukan@gmail.com>"
WORKDIR /code
COPY app/go.mod .
COPY app/main.go .
RUN go mod download
RUN go build -o /bin/server .



FROM alpine
# WORKDIR /app
COPY --from=builder /bin/server /bin/server
ENV SERVER_BIND_ADDR ":8000"
ENTRYPOINT [ "/bin/server" ]
