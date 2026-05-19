#include "Cyber/CyberPortalActor.h"

#include "Components/BoxComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Cyber/CyberAvatarCharacter.h"
#include "Kismet/GameplayStatics.h"
#include "UObject/ConstructorHelpers.h"

ACyberPortalActor::ACyberPortalActor()
{
	PrimaryActorTick.bCanEverTick = false;

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);

	FrameMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("FrameMesh"));
	FrameMesh->SetupAttachment(Root);
	FrameMesh->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
	FrameMesh->SetMobility(EComponentMobility::Static);
	FrameMesh->SetRelativeScale3D(FVector(2.0f, 0.3f, 3.0f));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(TEXT("/Engine/BasicShapes/Cube.Cube"));
	if (CubeMesh.Succeeded())
	{
		FrameMesh->SetStaticMesh(CubeMesh.Object);
	}

	InteractionBox = CreateDefaultSubobject<UBoxComponent>(TEXT("InteractionBox"));
	InteractionBox->SetupAttachment(Root);
	InteractionBox->SetBoxExtent(FVector(90.0f, 120.0f, 220.0f));
	InteractionBox->SetCollisionResponseToAllChannels(ECR_Ignore);
	InteractionBox->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
	InteractionBox->SetCollisionEnabled(ECollisionEnabled::QueryOnly);

	LabelText = CreateDefaultSubobject<UTextRenderComponent>(TEXT("LabelText"));
	LabelText->SetupAttachment(Root);
	LabelText->SetHorizontalAlignment(EHTA_Center);
	LabelText->SetWorldSize(42.0f);
	LabelText->SetRelativeLocation(FVector(0.0f, 0.0f, 220.0f));

	TargetLevel = NAME_None;
	PortalName = TEXT("Portal");
}

FString ACyberPortalActor::GetInteractLabel() const
{
	const FString Target = TargetLevel.IsNone() ? TEXT("Unknown") : TargetLevel.ToString();
	return FString::Printf(TEXT("[E] %s 이동 (%s)"), *PortalName, *Target);
}

void ACyberPortalActor::Interact(ACyberAvatarCharacter* Character)
{
	if (TargetLevel.IsNone())
	{
		return;
	}

	UGameplayStatics::OpenLevel(this, TargetLevel);
}

void ACyberPortalActor::ConfigurePortal(const FName InTargetLevel, const FString& InPortalName)
{
	TargetLevel = InTargetLevel;
	PortalName = InPortalName;
	LabelText->SetText(FText::FromString(PortalName));
}
