from .models import ModuleAccessRule, ApprovalRouting

def get_effective_access(user, module_name):
    if user.is_superuser:
        return {
            'actions': {'view': True, 'add': 'allow', 'edit': 'allow', 'delete': 'allow'},
            'excluded': []
        }

    emp_rule = ModuleAccessRule.objects.filter(employee=user, module_name=module_name).first()
    if emp_rule:
        return {
            'actions': emp_rule.actions,
            'excluded': emp_rule.excluded_pages or []
        }

    if user.role:
        role_rule = ModuleAccessRule.objects.filter(role=user.role, module_name=module_name).first()
        if role_rule:
            return {
                'actions': role_rule.actions,
                'excluded': role_rule.excluded_pages or []
            }

    if user.department:
        dept_rule = ModuleAccessRule.objects.filter(department=user.department, module_name=module_name).first()
        if dept_rule:
            return {
                'actions': dept_rule.actions,
                'excluded': dept_rule.excluded_pages or []
            }

    return {
        'actions': {'view': False, 'add': 'deny', 'edit': 'deny', 'delete': 'deny'},
        'excluded': []
    }

def get_all_user_access(user):
    from .models import SystemModule
    access_dict = {}
    for module in SystemModule.choices:
        mod_name = module[0]
        access_dict[mod_name] = get_effective_access(user, mod_name)
    return access_dict

def get_approver_for_module(module_name):
    route = ApprovalRouting.objects.filter(module_name=module_name).first()
    return route.designated_approver if route else None

