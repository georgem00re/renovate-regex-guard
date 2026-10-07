
generate-renovate-report:
	NVM_DIR="$${HOME}/.nvm" && \
		. "$${NVM_DIR}/nvm.sh" && \
		nvm use && \
		RENOVATE_CONFIG_FILE=renovate/renovate.json \
		npx --yes --package renovate@44.143.0 -- renovate \
			--platform=local \
			--dry-run=extract \
			--onboarding=false \
			--report-type=file \
			--report-path=renovate-report.json \
			--require-config=optional

check-renovate-expectations: generate-renovate-report
	NVM_DIR="$${HOME}/.nvm" && \
		. "$${NVM_DIR}/nvm.sh" && \
		nvm use && \
		node scripts/check-renovate-expectations.mjs \
			renovate-report.json \
			renovate/expectations.json
