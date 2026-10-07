
renovate-report:
	RENOVATE_CONFIG_FILE=renovate/renovate.json \
	NVM_DIR="$${HOME}/.nvm" && \
		. "$${NVM_DIR}/nvm.sh" && \
		nvm use && \
		npx --yes --package renovate@44.143.0 -- renovate \
			--platform=local \
			--dry-run=extract \
			--onboarding=false \
			--report-type=file \
			--report-path=renovate-report.json \
			--require-config=optional
