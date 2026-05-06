import os
import re

files_to_update = [
    'src/pages/Settings.tsx',
    'src/pages/Clients.tsx',
    'src/components/DeployNotification.tsx',
    'src/components/Layout.tsx',
    'src/components/UpdatePrompt.tsx',
    'src/pages/Notifications.tsx',
    'src/pages/Cart.tsx',
    'src/components/ThemeWrapper.tsx',
    'src/pages/SharedCart.tsx',
    'src/pages/Orders.tsx',
    'src/pages/Dashboard.tsx',
    'src/pages/Products.tsx',
    'src/pages/QRScanner.tsx',
    'src/App.tsx',
    'src/pages/Checkout.tsx'
]

mapping = {
    'UI': ['theme', 'primaryColor', 'fontSize', 'setTheme', 'setPrimaryColor', 'setFontSize', 'resetThemeToAuto'],
    'Auth': ['globalPin', 'currentSeller', 'supabaseUser', 'setGlobalPin', 'setCurrentSeller'],
    'Connection': ['isOnline', 'connectionStatus', 'onlineUsersCount', 'setConnectionStatus', 'setOnlineUsersCount'],
    'Orders': ['orders', 'totalOrders', 'grandTotalOrders', 'dashboardOrders', 'pendingOrdersCount', 'isOrdersLoading', 'ordersError', 'setOrders', 'setTotalOrders', 'setGrandTotalOrders', 'setDashboardOrders', 'setPendingOrdersCount', 'setIsOrdersLoading', 'setOrdersError', 'fetchOrders'],
    'Cart': ['cart', 'drafts', 'sharedCarts', 'selectedClient', 'currentDraftId', 'setCart', 'setDrafts', 'setSharedCarts', 'setSelectedClient', 'addToCart', 'removeFromCart', 'updateCartQuantity', 'clearCart', 'saveDraft', 'loadDraft', 'markDraftAsSent', 'shareCart', 'loadSharedCart'],
    'Notifications': ['notifications', 'unreadNotifications', 'deployEvent', 'fetchNotifications', 'sendNotification', 'markAllNotificationsAsRead', 'markNotificationAsShown', 'hasNotificationBeenShown', 'setDeployNotification', 'initializePushNotifications', 'setNotifications', 'setUnreadNotifications'],
    'App': ['products', 'clients', 'sellers', 'isLoading', 'apiError', 'appVersionInfo', 'hasNewVersion', 'currentAppVersion', 'setApiError', 'refreshData', 'forceRefresh', 'clearAllCaches', 'syncPendingOrders']
}

for filepath in files_to_update:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()

    # Find `const { ... } = useApp();`
    match = re.search(r'const\s+\{([^}]+)\}\s*=\s*useApp\(\);', content)
    if not match:
        # Check if it just uses `useApp()` without destructuring? 
        continue
    
    props_str = match.group(1)
    props = [p.strip() for p in props_str.split(',')]
    
    used_hooks = {}
    for p in props:
        if not p: continue
        # Handle aliasing like `theme: currentTheme`
        prop_name = p.split(':')[0].strip()
        
        found = False
        for context, keys in mapping.items():
            if prop_name in keys:
                used_hooks.setdefault(context, []).append(p)
                found = True
                break
        if not found:
            print(f"Warning: property {prop_name} not found in any context in {filepath}")
            used_hooks.setdefault('App', []).append(p)

    replacement = ""
    for context, props_list in used_hooks.items():
        if context == 'Notifications':
            hook_name = 'useNotificationsContext'
        else:
            hook_name = f'use{context}'
        replacement += f"  const {{ {', '.join(props_list)} }} = {hook_name}();\n"

    content = content.replace(match.group(0), replacement.strip())
    
    # Update imports
    import_replacements = []
    for context in used_hooks.keys():
        if context == 'App':
            import_replacements.append("useApp")
        elif context == 'Notifications':
            import_replacements.append("useNotificationsContext")
        else:
            import_replacements.append(f"use{context}")
            
    # Remove old useApp import
    content = re.sub(r'import\s+\{([^}]*?)useApp([^}]*?)\}\s+from\s+[\'"](.*?)AppContext[\'"];', lambda m: f'import {{{m.group(1)}{m.group(2)}}} from "{m.group(3)}AppContext";'.replace('{, ', '{').replace(', }', '}'), content)
    
    # Clean up empty import {  }
    content = re.sub(r'import\s+\{\s*\}\s+from\s+[\'"](.*?)AppContext[\'"];\n?', '', content)

    # Add new imports
    new_imports = ""
    for context in used_hooks.keys():
        if context == 'App':
            new_imports += "import { useApp } from '../AppContext';\n"
        elif context == 'Notifications':
            new_imports += f"import {{ useNotificationsContext }} from '../contexts/{context}Context';\n"
        else:
            new_imports += f"import {{ use{context} }} from '../contexts/{context}Context';\n"
            
    # Fix import paths (if in pages/ or components/, need '../', if in App.tsx, need './')
    if filepath.startswith('src/App.tsx'):
        new_imports = new_imports.replace('../', './')

    content = new_imports + content
    
    with open(filepath, 'w') as f:
        f.write(content)
        
    print(f"Updated {filepath}")

