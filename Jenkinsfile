pipeline {
    agent any

    environment {
        IMAGE_NAME = 'aerosibin/blue-green-api' 
        DOCKERHUB_CREDS = 'dockerhub-credentials'
        TAG = "${env.BUILD_ID}"
    }

    stages {
        stage('Initialize Network & Router') {
            steps {
                // Ensure a shared Docker network and the Nginx proxy exist
                bat '''
                    docker network inspect app-network >nul 2>&1 || docker network create app-network
                    docker ps --format "{{.Names}}" | findstr "nginx-router" >nul 2>&1 || docker run -d --name nginx-router -p 8000:80 --network app-network nginx:alpine
                '''
            }
        }

        stage('Build & Push to Docker Hub') {
            steps {
                bat "docker build -t %IMAGE_NAME%:%TAG% ."
                withCredentials([usernamePassword(credentialsId: env.DOCKERHUB_CREDS, passwordVariable: 'DOCKER_PWD', usernameVariable: 'DOCKER_USR')]) {
                    bat """
                        docker login -u %DOCKER_USR% -p %DOCKER_PWD%
                        docker push %IMAGE_NAME%:%TAG%
                    """
                }
            }
        }

        stage('Determine Target Environment') {
            steps {
                script {
                    // If node-blue is running, deploy to green next. Otherwise, deploy to blue.
                    def isBlueRunning = bat(script: 'docker ps --format "{{.Names}}" | findstr "node-blue"', returnStatus: true) == 0
                    env.ACTIVE_ENV = isBlueRunning ? 'blue' : 'green'
                    env.TARGET_ENV = isBlueRunning ? 'green' : 'blue'
                    echo "Current active environment: ${env.ACTIVE_ENV}"
                    echo "Deploying new version to: ${env.TARGET_ENV}"
                }
            }
        }

        stage('Deploy Target Environment') {
            steps {
                bat '''
                    docker rm -f node-%TARGET_ENV% >nul 2>&1 || true
                    docker run -d --name node-%TARGET_ENV% --network app-network -e NODE_ENV=%TARGET_ENV% %IMAGE_NAME%:%TAG%
                '''
            }
        }

        stage('Health Check') {
            steps {
                // Allow Node.js 5 seconds to boot, then verify the /status endpoint
                bat '''
                    ping 127.0.0.1 -n 6 > nul
                    docker exec nginx-router wget -qO- http://node-%TARGET_ENV%:3000/status
                '''
            }
        }

        stage('Switch Traffic (Zero Downtime)') {
            steps {
                script {
                    // Generate a new Nginx configuration pointing to the freshly validated container
                    def nginxConfig = """
                    events {}
                    http {
                        upstream backend {
                            server node-${env.TARGET_ENV}:3000;
                        }
                        server {
                            listen 80;
                            location / {
                                proxy_pass http://backend;
                            }
                        }
                    }
                    """
                    writeFile file: 'nginx.conf', text: nginxConfig
                }
                // Inject the new config into the router and gracefully reload
                bat '''
                    docker cp nginx.conf nginx-router:/etc/nginx/nginx.conf
                    docker exec nginx-router nginx -s reload
                '''
            }
        }

        stage('Teardown Old Environment') {
            steps {
                // Remove the old container to free up resources
                bat 'docker rm -f node-%ACTIVE_ENV% >nul 2>&1 || true'
            }
        }
    }
}