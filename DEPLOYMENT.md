# Deployment Workflow

## Branch Strategy

### Development Branch (`development`)
- **Platform:** Render (Free Tier)
- **Purpose:** Testing and development
- **Auto-deploy:** Yes
- **Environment:** Development
- **URL:** [Your Render URL]

### Main Branch (`main`)
- **Platform:** Railway (Production)
- **Purpose:** Production deployment
- **Auto-deploy:** Yes (on merge to main)
- **Environment:** Production
- **URL:** [Your Railway URL]

## Workflow Steps

1. **Development Work:**
   ```bash
   git checkout development
   # Make your changes
   git add .
   git commit -m "Your changes"
   git push origin development
   ```
   → Automatically deploys to Render for testing

2. **Production Deployment:**
   ```bash
   git checkout main
   git merge development
   git push origin main
   ```
   → Automatically deploys to Railway for production

## Environment Variables

### Development (Render)
```
NODE_ENV=development
JWT_SECRET=21827d0ec070633861c532653a108c0acc3f197f7692d0fc3fb2e93c3623c9701069f6f90589c55d73424030c3d1e32762df1c2a95751d28d0b61725b7b9039e
ENABLE_PUSH_NOTIFICATIONS=true
# Add your development database and Firebase configs
```

### Production (Railway)
```
NODE_ENV=production
JWT_SECRET=[Different production secret]
ENABLE_PUSH_NOTIFICATIONS=true
# Add your production database and Firebase configs
```

## Security Notes
- Different JWT secrets for dev/prod
- Separate database instances recommended
- Firebase can use same project or separate dev/prod projects

