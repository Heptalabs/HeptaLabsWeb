#include "Cyber/CyberAvatarCharacter.h"

#include "Cyber/CyberCasinoTable.h"
#include "Cyber/CyberPortalActor.h"
#include "Cyber/CyberShopTerminal.h"
#include "Cyber/CyberSpeechPodium.h"
#include "Camera/CameraComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/Engine.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "InputCoreTypes.h"
#include "UObject/ConstructorHelpers.h"

ACyberAvatarCharacter::ACyberAvatarCharacter()
{
	PrimaryActorTick.bCanEverTick = true;

	bUseControllerRotationYaw = true;
	GetCharacterMovement()->bOrientRotationToMovement = false;
	GetCharacterMovement()->MaxWalkSpeed = 680.0f;
	GetCharacterMovement()->JumpZVelocity = 620.0f;
	GetCharacterMovement()->AirControl = 0.45f;

	if (GetCameraBoom())
	{
		GetCameraBoom()->TargetArmLength = 360.0f;
		GetCameraBoom()->SocketOffset = FVector(0.0f, 70.0f, 80.0f);
	}

	if (GetFollowCamera())
	{
		GetFollowCamera()->FieldOfView = 98.0f;
	}

	InitializeCyberpunkSuit();
}

void ACyberAvatarCharacter::BeginPlay()
{
	Super::BeginPlay();
	PushStatusMessage(TEXT("사이버 구역 입장 완료"));
}

void ACyberAvatarCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	FocusedActor = TraceInteractable();

	if (StatusMessageRemaining > 0.0f)
	{
		StatusMessageRemaining = FMath::Max(0.0f, StatusMessageRemaining - DeltaSeconds);
	}

	RefreshHud();
}

void ACyberAvatarCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	PlayerInputComponent->BindAxis(TEXT("MoveForward"), this, &ACyberAvatarCharacter::MoveForwardLegacy);
	PlayerInputComponent->BindAxis(TEXT("MoveRight"), this, &ACyberAvatarCharacter::MoveRightLegacy);
	PlayerInputComponent->BindAxis(TEXT("Turn"), this, &ACyberAvatarCharacter::TurnLegacy);
	PlayerInputComponent->BindAxis(TEXT("LookUp"), this, &ACyberAvatarCharacter::LookUpLegacy);

	PlayerInputComponent->BindAction(TEXT("JumpLegacy"), IE_Pressed, this, &ACyberAvatarCharacter::DoJumpStart);
	PlayerInputComponent->BindAction(TEXT("JumpLegacy"), IE_Released, this, &ACyberAvatarCharacter::DoJumpEnd);

	PlayerInputComponent->BindKey(EKeys::E, IE_Pressed, this, &ACyberAvatarCharacter::OnInteractPressed);
	PlayerInputComponent->BindKey(EKeys::One, IE_Pressed, this, &ACyberAvatarCharacter::OnOption1Pressed);
	PlayerInputComponent->BindKey(EKeys::Two, IE_Pressed, this, &ACyberAvatarCharacter::OnOption2Pressed);
	PlayerInputComponent->BindKey(EKeys::Three, IE_Pressed, this, &ACyberAvatarCharacter::OnOption3Pressed);
}

bool ACyberAvatarCharacter::SpendCoins(int32 Amount)
{
	if (Amount <= 0)
	{
		return true;
	}

	if (Coins < Amount)
	{
		return false;
	}

	Coins -= Amount;
	return true;
}

void ACyberAvatarCharacter::AddCoins(int32 Amount)
{
	Coins += FMath::Max(0, Amount);
}

void ACyberAvatarCharacter::AddInventoryItem(const FName ItemId, int32 Amount)
{
	if (ItemId.IsNone() || Amount <= 0)
	{
		return;
	}

	Inventory.FindOrAdd(ItemId) += Amount;
}

void ACyberAvatarCharacter::PushStatusMessage(const FString& Message)
{
	StatusMessage = Message;
	StatusMessageRemaining = 5.0f;
}

void ACyberAvatarCharacter::OpenShop(ACyberShopTerminal* Terminal)
{
	ActiveShop = Terminal;
	ActiveCasino = nullptr;
	ActivePodium = nullptr;
	InteractionMode = ECyberInteractionMode::Shop;
}

void ACyberAvatarCharacter::OpenCasino(ACyberCasinoTable* Table)
{
	ActiveCasino = Table;
	ActiveShop = nullptr;
	ActivePodium = nullptr;
	InteractionMode = ECyberInteractionMode::Casino;
}

void ACyberAvatarCharacter::OpenSpeech(ACyberSpeechPodium* Podium)
{
	ActivePodium = Podium;
	ActiveShop = nullptr;
	ActiveCasino = nullptr;
	InteractionMode = ECyberInteractionMode::Speech;
}

void ACyberAvatarCharacter::CloseInteractionMode()
{
	InteractionMode = ECyberInteractionMode::None;
	ActiveShop = nullptr;
	ActiveCasino = nullptr;
	ActivePodium = nullptr;
}

void ACyberAvatarCharacter::MoveForwardLegacy(float Value)
{
	if (!FMath::IsNearlyZero(Value))
	{
		DoMove(0.0f, Value);
	}
}

void ACyberAvatarCharacter::MoveRightLegacy(float Value)
{
	if (!FMath::IsNearlyZero(Value))
	{
		DoMove(Value, 0.0f);
	}
}

void ACyberAvatarCharacter::TurnLegacy(float Value)
{
	if (!FMath::IsNearlyZero(Value))
	{
		DoLook(Value * TurnSensitivity, 0.0f);
	}
}

void ACyberAvatarCharacter::LookUpLegacy(float Value)
{
	if (!FMath::IsNearlyZero(Value))
	{
		DoLook(0.0f, Value * LookSensitivity);
	}
}

void ACyberAvatarCharacter::OnInteractPressed()
{
	if (InteractionMode != ECyberInteractionMode::None)
	{
		if (InteractionMode == ECyberInteractionMode::Speech && ActivePodium.IsValid())
		{
			ActivePodium->Interact(this);
		}
		else
		{
			CloseInteractionMode();
			PushStatusMessage(TEXT("상호작용 종료"));
		}
		return;
	}

	AActor* HitActor = FocusedActor.Get();
	if (!HitActor)
	{
		return;
	}

	if (ACyberPortalActor* Portal = Cast<ACyberPortalActor>(HitActor))
	{
		Portal->Interact(this);
		return;
	}
	if (ACyberShopTerminal* Shop = Cast<ACyberShopTerminal>(HitActor))
	{
		Shop->Interact(this);
		return;
	}
	if (ACyberCasinoTable* Casino = Cast<ACyberCasinoTable>(HitActor))
	{
		Casino->Interact(this);
		return;
	}
	if (ACyberSpeechPodium* Podium = Cast<ACyberSpeechPodium>(HitActor))
	{
		Podium->Interact(this);
		return;
	}
}

void ACyberAvatarCharacter::OnOption1Pressed()
{
	HandleOption(0);
}

void ACyberAvatarCharacter::OnOption2Pressed()
{
	HandleOption(1);
}

void ACyberAvatarCharacter::OnOption3Pressed()
{
	HandleOption(2);
}

void ACyberAvatarCharacter::HandleOption(int32 OptionIndex)
{
	switch (InteractionMode)
	{
	case ECyberInteractionMode::Shop:
		if (ActiveShop.IsValid())
		{
			ActiveShop->HandleOption(this, OptionIndex);
		}
		break;
	case ECyberInteractionMode::Casino:
		if (ActiveCasino.IsValid())
		{
			ActiveCasino->HandleOption(this, OptionIndex);
		}
		break;
	case ECyberInteractionMode::Speech:
		if (ActivePodium.IsValid())
		{
			ActivePodium->HandleOption(this, OptionIndex);
		}
		break;
	case ECyberInteractionMode::None:
	default:
		break;
	}
}

AActor* ACyberAvatarCharacter::TraceInteractable() const
{
	if (!Controller)
	{
		return nullptr;
	}

	FVector ViewLoc;
	FRotator ViewRot;
	Controller->GetPlayerViewPoint(ViewLoc, ViewRot);

	FHitResult HitResult;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(CyberInteractTrace), true, this);
	const FVector End = ViewLoc + (ViewRot.Vector() * InteractionDistance);
	if (!GetWorld()->LineTraceSingleByChannel(HitResult, ViewLoc, End, ECC_Visibility, Params))
	{
		return nullptr;
	}

	AActor* HitActor = HitResult.GetActor();
	if (!HitActor)
	{
		return nullptr;
	}

	if (HitActor->IsA<ACyberPortalActor>() || HitActor->IsA<ACyberShopTerminal>() || HitActor->IsA<ACyberCasinoTable>() || HitActor->IsA<ACyberSpeechPodium>())
	{
		return HitActor;
	}

	return nullptr;
}

FString ACyberAvatarCharacter::BuildPromptText() const
{
	if (InteractionMode == ECyberInteractionMode::Shop && ActiveShop.IsValid())
	{
		return ActiveShop->BuildMenuText();
	}
	if (InteractionMode == ECyberInteractionMode::Casino && ActiveCasino.IsValid())
	{
		return ActiveCasino->BuildMenuText();
	}
	if (InteractionMode == ECyberInteractionMode::Speech && ActivePodium.IsValid())
	{
		return ActivePodium->BuildMenuText();
	}

	if (AActor* HitActor = FocusedActor.Get())
	{
		if (const ACyberPortalActor* Portal = Cast<ACyberPortalActor>(HitActor))
		{
			return Portal->GetInteractLabel();
		}
		if (const ACyberShopTerminal* Shop = Cast<ACyberShopTerminal>(HitActor))
		{
			return Shop->GetInteractLabel();
		}
		if (const ACyberCasinoTable* Casino = Cast<ACyberCasinoTable>(HitActor))
		{
			return Casino->GetInteractLabel();
		}
		if (const ACyberSpeechPodium* Podium = Cast<ACyberSpeechPodium>(HitActor))
		{
			return Podium->GetInteractLabel(this);
		}
	}

	return TEXT("WASD 이동 | 마우스 시점 | Space 점프");
}

FString ACyberAvatarCharacter::BuildInventorySummary() const
{
	if (Inventory.Num() == 0)
	{
		return TEXT("인벤토리 비어있음");
	}

	FString Summary;
	int32 Count = 0;
	for (const TPair<FName, int32>& Pair : Inventory)
	{
		Summary += FString::Printf(TEXT("%s x%d "), *Pair.Key.ToString(), Pair.Value);
		if (++Count >= 3)
		{
			break;
		}
	}
	return Summary;
}

void ACyberAvatarCharacter::RefreshHud()
{
	if (!GEngine)
	{
		return;
	}

	const FString Hud = FString::Printf(
		TEXT("[CyberVerse] Coins:%d | %s\n%s\n%s"),
		Coins,
		*BuildInventorySummary(),
		*BuildPromptText(),
		StatusMessageRemaining > 0.0f ? *StatusMessage : TEXT(""));

	GEngine->AddOnScreenDebugMessage(1, 0.0f, FColor::Cyan, Hud);
}

void ACyberAvatarCharacter::InitializeCyberpunkSuit()
{
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(TEXT("/Engine/BasicShapes/Cube.Cube"));
	if (!CubeMesh.Succeeded())
	{
		return;
	}

	ChestCoreMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("ChestCoreMesh"));
	ChestCoreMesh->SetupAttachment(GetRootComponent());
	ChestCoreMesh->SetStaticMesh(CubeMesh.Object);
	ChestCoreMesh->SetRelativeLocation(FVector(25.0f, 0.0f, 75.0f));
	ChestCoreMesh->SetRelativeScale3D(FVector(0.24f, 0.14f, 0.32f));
	ChestCoreMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	BackCoreMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("BackCoreMesh"));
	BackCoreMesh->SetupAttachment(GetRootComponent());
	BackCoreMesh->SetStaticMesh(CubeMesh.Object);
	BackCoreMesh->SetRelativeLocation(FVector(-22.0f, 0.0f, 70.0f));
	BackCoreMesh->SetRelativeScale3D(FVector(0.20f, 0.12f, 0.35f));
	BackCoreMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	VisorMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("VisorMesh"));
	VisorMesh->SetupAttachment(GetRootComponent());
	VisorMesh->SetStaticMesh(CubeMesh.Object);
	VisorMesh->SetRelativeLocation(FVector(34.0f, 0.0f, 110.0f));
	VisorMesh->SetRelativeScale3D(FVector(0.14f, 0.08f, 0.06f));
	VisorMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
}
